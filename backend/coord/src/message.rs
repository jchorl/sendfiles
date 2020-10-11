use serde::Deserialize;
use serde::Serialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageIn {
    pub action: String, // this should be SEND_MESSAGE
    pub recipient: String,
    pub body: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageOut {
    pub sender: String,
    pub recipient: String,
    pub body: String,
}
