use std::io::{Cursor, Error, Read};

use {
    anyhow::Result,
    bytes::Bytes,
    reqwest::Client,
    zip::{ZipArchive, read::ZipFile},
};

pub struct Archive {
    archive: ZipArchive<Cursor<Bytes>>,
    file_stem: String,
    lang_0: &'static str,
    lang_1: &'static str,
}

pub struct File<'a> {
    file: ZipFile<'a>,
}

impl Archive {
    pub async fn fetch(
        corpus: &'static str,
        version: &'static str,
        lang_0: &'static str,
        lang_1: &'static str,
    ) -> Result<Self> {
        Ok(Self {
            // TODO decompress as a byte stream
            archive: ZipArchive::new(Cursor::new(
                Client::new()
                    .get(format!(
                        "https://object.pouta.csc.fi/OPUS-{corpus}/v{version}/moses/{lang_0}-{lang_1}.txt.zip"
                    ))
                    .send()
                    .await?
                    .bytes()
                    .await?,
            ))?,
            file_stem: format!("{corpus}.{lang_0}-{lang_1}"),
            lang_0,
            lang_1,
        })
    }

    pub fn file_0(&mut self) -> Result<File> {
        let Self {
            archive,
            file_stem,
            lang_0,
            ..
        } = self;
        Ok(File {
            file: archive.by_name(&format!("{file_stem}.{lang_0}"))?,
        })
    }

    pub fn file_1(&mut self) -> Result<File> {
        let Self {
            archive,
            file_stem,
            lang_1,
            ..
        } = self;
        Ok(File {
            file: archive.by_name(&format!("{file_stem}.{lang_1}"))?,
        })
    }
}

impl Read for File<'_> {
    fn read(&mut self, buffer: &mut [u8]) -> Result<usize, Error> {
        self.file.read(buffer)
    }
}
