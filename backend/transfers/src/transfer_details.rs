use aws_sdk_dynamodb::types::AttributeValue;
use chrono::{DateTime, Utc};
use serde_derive::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TransferDetails {
    #[serde(skip_deserializing)]
    pub id: String,
    pub file_name: String,
    pub content_length_bytes: u32,
    pub private_key: String,
    pub valid_until: DateTime<Utc>,
}

impl TryFrom<&HashMap<String, AttributeValue>> for TransferDetails {
    type Error = ();

    fn try_from(value: &HashMap<String, AttributeValue>) -> Result<Self, Self::Error> {
        Ok(TransferDetails {
            id: value
                .get("id")
                .ok_or(())?
                .as_s()
                .map_err(|_| ())?
                .to_owned(),
            file_name: value
                .get("file_name")
                .ok_or(())?
                .as_s()
                .map_err(|_| ())?
                .to_owned(),
            content_length_bytes: value
                .get("content_length_bytes")
                .ok_or(())?
                .as_n()
                .map_err(|_| ())?
                .parse::<u32>()
                .map_err(|_| ())?,
            private_key: value
                .get("private_key")
                .ok_or(())?
                .as_s()
                .map_err(|_| ())?
                .to_owned(),
            valid_until: DateTime::<Utc>::from_timestamp(
                value
                    .get("valid_until")
                    .ok_or(())?
                    .as_n()
                    .map_err(|_| ())?
                    .parse::<i64>()
                    .map_err(|_| ())?,
                0,
            )
            .ok_or(())?,
        })
    }
}
