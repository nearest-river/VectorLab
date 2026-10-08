use wasm_bindgen::prelude::*;


#[wasm_bindgen(start)]
fn _start() {
  console_error_panic_hook::set_once();
  console_log::init().unwrap();
}


#[wasm_bindgen]
pub fn limit(a0: String,a1: String,a2: String,a3: String)-> JsValue {
  dbg!(a0,a1,a2,a3);

  JsValue::UNDEFINED
}





























