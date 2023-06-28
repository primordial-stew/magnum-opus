use {anyhow::Result, regex::Regex};

pub struct Tokenizer {
    regex: Regex,
}

impl Tokenizer {
    pub fn compile() -> Result<Self> {
        Ok(Self {
            regex: Regex::new(r"\p{L}+|\p{P}+")?,
        })
    }

    pub fn tokens<'t>(&self, line: &'t str) -> Vec<&'t str> {
        self.regex
            .find_iter(line)
            .map(|r#match| r#match.as_str())
            .collect::<Vec<_>>()
    }
}
