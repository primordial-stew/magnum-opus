use std::{
    fs::File,
    io::{Cursor, Read, Seek, copy},
};

use {anyhow::Result, reqwest::Client, zip::ZipArchive};

pub async fn fetch(corpus: &str, version: &str, lang0: &str, lang1: &str) -> Result<()> {
    let mut archive = ZipArchive::new(Cursor::new(
        Client::new()
            .get(format!(
                "https://object.pouta.csc.fi/OPUS-{corpus}/v{version}/moses/{lang0}-{lang1}.txt.zip"
            ))
            .send()
            .await?
            .bytes()
            .await?,
    ))?;
    let source_file_stem = format!("{corpus}.{lang0}-{lang1}");
    let target_file_stem = format!("{corpus}.{version}.{lang0}-{lang1}");
    // TODO decompress asynchronously
    decompress(
        &mut archive,
        &format!("{source_file_stem}.{lang0}"),
        &format!("{target_file_stem}.{lang0}"),
    )?;
    decompress(
        &mut archive,
        &format!("{source_file_stem}.{lang1}"),
        &format!("{target_file_stem}.{lang1}"),
    )?;
    Ok(())
}

fn decompress<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
    source_file_name: &str,
    target_file_name: &str,
) -> Result<()> {
    copy(
        &mut archive.by_name(source_file_name)?,
        &mut File::create(target_file_name)?,
    )?;
    Ok(())
}
