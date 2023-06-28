mod archive;
mod reader;
mod tokenizer;

use std::{
    fs::{File, create_dir_all, exists},
    io::copy,
};

use {anyhow::Result, tokio::main};

use {archive::Archive, reader::Reader, tokenizer::Tokenizer};

#[main]
async fn main() -> Result<()> {
    let dir = ".magnum-opus";
    let corpus = "Tatoeba";
    let version = "2023-04-12";
    let lang_0 = "en";
    let lang_1 = "es";
    let stem = format!("{dir}/{corpus}.{version}.{lang_0}-{lang_1}");
    let path_0 = format!("{stem}.{lang_0}");
    let path_1 = format!("{stem}.{lang_1}");
    let exists_0 = exists(&path_0)?;
    let exists_1 = exists(&path_1)?;
    if !exists_0 || !exists_1 {
        println!("Fetching OPUS data");
        let mut archive = Archive::fetch(corpus, version, lang_0, lang_1).await?;
        if !exists_0 && !exists_1 {
            create_dir_all(dir)?;
        }
        if !exists_0 {
            copy(&mut archive.file_0()?, &mut File::create(&path_0)?)?;
        }
        if !exists_1 {
            copy(&mut archive.file_1()?, &mut File::create(&path_1)?)?;
        }
    }
    println!("Tokenizing OPUS data");
    let tokenizer = Tokenizer::compile()?;
    for (result_0, result_1) in Reader::new(File::open(&path_0)?, File::open(&path_1)?) {
        let line_0 = result_0?;
        let line_1 = result_1?;
        let words_0 = tokenizer.tokens(&line_0);
        let words_1 = tokenizer.tokens(&line_1);
        if words_0.len() == 0 && words_1.len() == 0 {
            continue;
        }
        if words_0.len() > 2 || words_1.len() > 2 {
            continue;
        }
        println!("========");
        println!("{words_0:?}");
        println!("{words_1:?}");
    }
    Ok(())
}
