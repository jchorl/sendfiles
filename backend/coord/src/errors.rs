use std::fmt;

#[derive(Debug)]
pub struct BadRequestError;

impl fmt::Display for BadRequestError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Request is invalid")
    }
}

impl std::error::Error for BadRequestError {}

pub type Error = Box<dyn std::error::Error + Send + Sync + 'static>;
