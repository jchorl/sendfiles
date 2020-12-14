use std::fmt;

#[derive(Debug)]
pub struct BadRequestError;

impl fmt::Display for BadRequestError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Request is invalid")
    }
}

impl std::error::Error for BadRequestError {}

#[derive(Debug)]
pub struct SenderGoneError;

impl fmt::Display for SenderGoneError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Sender is gone. Ensure they leave their browser window open as you transfer the file.")
    }
}

impl std::error::Error for SenderGoneError {}

pub type Error = Box<dyn std::error::Error + Send + Sync + 'static>;
