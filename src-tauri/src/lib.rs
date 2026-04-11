mod editor_message;

use tauri::{Builder, Result, command};

use editor_message::EditorMessage;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

#[command]
fn receive_message(message: EditorMessage) -> Result<String> {
    println!("Received message: {:#?}", message);
    Ok("yeah".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![receive_message])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
