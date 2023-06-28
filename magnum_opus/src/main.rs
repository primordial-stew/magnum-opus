mod opus;

use {anyhow::Result, tokio::main};

use opus::fetch;

#[main]
async fn main() -> Result<()> {
    println!("Fetching OPUS data");
    fetch("Tatoeba", "2023-04-12", "en", "es").await?;
    Ok(())
}
