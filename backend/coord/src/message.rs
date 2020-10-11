use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Type {
    NewRecipient,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub sender: String,
    pub recipient: String,
    pub message_type: Type,
    pub body: Option<String>,
}
