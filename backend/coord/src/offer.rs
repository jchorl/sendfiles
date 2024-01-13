use aws_sdk_dynamodb::types::AttributeValue;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

pub struct Offer {
    pub transfer_id: String,
    pub api_gateway_connection_id: String,
    pub valid_until: DateTime<Utc>,
}

impl TryFrom<&HashMap<String, AttributeValue>> for Offer {
    type Error = ();

    fn try_from(value: &HashMap<String, AttributeValue>) -> Result<Self, Self::Error> {
        Ok(Offer {
            transfer_id: value
                .get("transfer_id")
                .ok_or(())?
                .as_s()
                .map_err(|_| ())?
                .to_owned(),
            api_gateway_connection_id: value
                .get("api_gateway_connection_id")
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
