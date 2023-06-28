export async function fetchOpusTmx(
  corpus: string,
  lang1: string,
  lang2: string,
) {
  const resp = await fetch(
    `https://opus.nlpl.eu/download.php?f=${corpus}/v2023-04-12/tmx/${lang1}-${lang2}.tmx.gz`,
  );

  return resp.body
    ?.pipeThrough(new DecompressionStream("gzip"))
    .pipeThrough(new TextDecoderStream());
}
