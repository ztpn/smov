import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { convert } from "subsrt-ts";

import { proxiedFetch } from "@/backend/helpers/fetch";
import { Menu } from "@/components/player/internals/ContextMenu";
import { useOverlayRouter } from "@/hooks/useOverlayRouter";
import { usePlayerStore } from "@/stores/player/store";
import { getPrettyLanguageNameFromLocale } from "@/utils/language";

import { ScrapedCaptionOption } from "./CaptionsView";

export type FetchType = {
  id: string;
  url: string;
  type: string;
  language: string;
  hasCorsRestrictions: boolean;
};

async function search(imdbId: string, season?: number, episode?: number) {
  const base = "https://rest.opensubtitles.org";
  const headers = { "X-User-Agent": "VLSub 0.10.2" };
  const url = `${base}/search/${season && episode ? `episode-${episode}/` : ""}imdbid-${imdbId}${season ? `/season-${season}` : ""}`;
  const data = await proxiedFetch(url, { headers });
  let subtitles = data.map(
    (sub: { SubDownloadLink: string; SubFormat: string; ISO639: string }) => {
      const caption = sub.SubDownloadLink.replace(".gz", "").replace(
        "download/",
        "download/subencoding-utf8/",
      );
      return {
        id: caption,
        url: caption,
        type: sub.SubFormat,
        language: sub.ISO639,
        hasCorsRestrictions: false,
      };
    },
  );

  subtitles = subtitles.reduce((unique: FetchType[], o: FetchType) => {
    if (getPrettyLanguageNameFromLocale(o.language) !== null) {
      if (!unique.find((obj: FetchType) => obj.language === o.language)) {
        unique.push(o);
      }
    }
    return unique;
  }, []);

  return subtitles;
}

export function CaptionScrapingView({ id }: { id: string }) {
  const { t } = useTranslation();
  const router = useOverlayRouter(id);
  const meta = usePlayerStore((s) => s.meta);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<FetchType[]>([]);
  const setCaption = usePlayerStore((s) => s.setCaption);
  const imdbID = meta?.imdbId ? meta.imdbId.slice(2) : "";
  const [selectedCaptionId] = useState<string | undefined>();

  const subs = data.map((v) => (
    <ScrapedCaptionOption
      // key must use index to prevent url collisions
      key={v.id}
      id={v.id}
      countryCode={v.language}
      selected={v.id === selectedCaptionId}
      onClick={async () => {
        const text = await (await proxiedFetch(v.url)).text();
        const converted = convert(text, "srt");
        setCaption({
          language: v.language,
          srtData: converted,
          id: `scraped - ${v.language}`,
        });
      }}
    >
      {getPrettyLanguageNameFromLocale(v.language)}
    </ScrapedCaptionOption>
  ));

  useEffect(() => {
    const fetchData = async () => {
      const result = await search(imdbID);
      setData(result);
      setIsLoading(false);
    };

    fetchData();
  }, [imdbID]);

  // Shits fire
  return (
    <>
      <Menu.BackLink onClick={() => router.navigate("/captions")}>
        {t("player.menus.scraping.settings.backlink")}
      </Menu.BackLink>
      <Menu.ScrollToActiveSection className="!pt-2 mt-2 pb-3">
        {isLoading ? (
          <p className="text-center text-xl">Scraping subtitles...</p>
        ) : data.length === 0 ? (
          <p className="text-center text-xl">
            Couldn&apos;t find any subtitles :(
          </p>
        ) : (
          subs
        )}
      </Menu.ScrollToActiveSection>
    </>
  );
}
