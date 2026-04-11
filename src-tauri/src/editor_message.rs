use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum EditorType {
    String,
    Number,
    Boolean,
    Object,
    Array,
    Null,
    Color,
    Datetime,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RootType {
    Object,
    Array,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Direction {
    Up,
    Down,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum JsonEdit {
    #[serde(rename_all = "camelCase")]
    Contents { path: Vec<String>, new_value: Value },
    #[serde(rename_all = "camelCase")]
    Add {
        path: Vec<String>,
        item_type: EditorType,
        value: Value,
        parent_type: RootType,
    },
    #[serde(rename_all = "camelCase")]
    Delete { path: Vec<String> },
    #[serde(rename_all = "camelCase")]
    Rename { path: Vec<String>, new_name: String },
    // #[serde(rename_all = "camelCase")]
    Move {
        path: Vec<String>,
        direction: Direction,
    },
    #[serde(rename_all = "camelCase")]
    Type {
        path: Vec<String>,
        new_type: EditorType,
    },
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum EditorMessage {
    Edit {
        edit: JsonEdit,
    },
    DebugMsg {
        message: String,
    },
    ErrorMsg {
        message: String,
    },
    #[serde(rename_all = "camelCase")]
    GetDataResponse {
        request_id: String,
        root_type: RootType,
        html: String,
    },
    Ready,
}
