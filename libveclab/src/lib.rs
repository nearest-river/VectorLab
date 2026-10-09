
mod lim;

use serde::Serialize;
use wasm_bindgen::prelude::*;

#[derive(Serialize)]
pub struct Tex {
    pub input: String,
    pub result: String,
}

#[derive(Serialize)]
pub struct Step {
    pub t: String,
    pub l: Vec<String>,
    pub n: Option<String>,
    pub sub: Option<Vec<Step>>,
}

#[derive(Serialize)]
pub struct LimitResult {
    pub input: String,
    pub a: String,
    pub est: bool,
    pub tex: Tex,
    pub steps: Vec<Step>,
}

#[derive(Serialize)]
pub struct DifferentiateResult {
    pub input: String,
    pub order: usize,
    pub tex: Tex,
    pub rule: Option<String>,
    pub steps: Vec<Step>,
    pub chain: Vec<String>,
}

#[derive(Serialize)]
pub struct IntegrateResult {
    pub tex: Tex,
    pub rule: Option<String>,
    pub steps: Vec<Step>,
}

#[derive(Serialize)]
pub struct DefiniteTex {
    pub input: String,
    pub exact: String,
    pub approx: Option<String>,
}

#[derive(Serialize)]
pub struct DefiniteResult {
    pub tex: DefiniteTex,
    pub zeroWidth: bool,
    pub rule: Option<String>,
    pub steps: Vec<Step>,
}




#[wasm_bindgen(start)]
fn _start() {
  console_error_panic_hook::set_once();
  console_log::init().unwrap();
}

#[wasm_bindgen]
pub fn limit(expr: String,var: String,point: String,dir: String)-> Result<JsValue,JsError> {
  // calculate...

  let result=LimitResult {
    input: expr,
    a: point,
    est: false,
    tex: Tex {
      input: "...".into(),
      result: "...".into(),
    },
    steps: vec![],
  };

  serde_wasm_bindgen::to_value(&result)
  .map_err(|e| JsError::from(e))
}



#[wasm_bindgen]
pub fn differentiate(_expr: String,_var: String,_order: usize)-> Result<JsValue,JsValue> {
  todo!()
}

#[wasm_bindgen]
pub fn integrate(_expr: String)-> Result<JsValue,JsValue> {
  todo!()
}

#[wasm_bindgen]
pub fn definite(_expr: String,_lower: String,_upper: String)-> Result<JsValue,JsValue> {
  todo!()
}



























