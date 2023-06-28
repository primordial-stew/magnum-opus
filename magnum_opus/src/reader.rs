use std::{
    io::{BufRead, BufReader, Error, Lines, Read},
    iter::Zip,
};

pub struct Reader<R0, R1> {
    zip: Zip<Lines<BufReader<R0>>, Lines<BufReader<R1>>>,
}

impl<R0: Read, R1: Read> Reader<R0, R1> {
    pub fn new(reader_0: R0, reader_1: R1) -> Self {
        Self {
            zip: BufReader::new(reader_0)
                .lines()
                .zip(BufReader::new(reader_1).lines()),
        }
    }
}

impl<R0: Read, R1: Read> Iterator for Reader<R0, R1> {
    type Item = (Result<String, Error>, Result<String, Error>);

    fn next(&mut self) -> Option<Self::Item> {
        self.zip.next()
    }
}
