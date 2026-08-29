// API boundary for PART 3. Credentials, PINs, tokens, and GAS URLs do not belong here.
// The backend session model will be added only after its security proof is complete.
export class ApiClient {
  async bootstrap(){
    throw new Error("API ยังไม่ได้ตั้งค่าการยืนยันตัวตนสำหรับ GitHub Pages");
  }
  async transaction(){
    throw new Error("ธุรกรรมถูกปิดไว้จนกว่า API authentication จะพร้อม");
  }
}
