export interface User {
    uid: uniqid,
    nid: string,
    name: string,
    gender: 'M'|'F',
    birth_date: string,
    address: string,
    line_id: string,
    contact_home_number: string,
    contact_mobile_number: string,
    role: number,
    bank_code: string,
    branch_code: string,
    bank_account_name: string,
    bank_account_number: string,
    emergency_nid: uniqid,
    emergency_contact: string,
    emergency_contact_number: string,
    emergency_contact_relation: string,
    relative_path: string,
    referrer_uid: uniqid,
    referrer_path: string,
    volunteer_uid: uniqid,
    volunteer_path: string,
    revoked: boolean,
    password: string,
    update_time: number,
    create_time: number,
}

export type User_Registr = Omit<User, 'relative_path'|'referrer_uid'|'referrer_path'|'volunteer_uid'|'volunteer_path'|'role'|'update_time'|'create_time'>&{
    referrer_mobile_number:User['contact_mobile_number'], volunteer_mobile_number:User['contact_mobile_number']
};


export function isValidPassword(password) {
    // Define a regular expression pattern
    const regex = /^(?=.*[A-Z])(?=.*[a-zA-Z0-9]{3,}).{8,}$/;
  
    // Test if the password matches the pattern
    return regex.test(password);
}
export function isValidTaiwanNationalID(nid:string) {
    // Check if the ID has the correct format
    nid = nid.toUpperCase();
    const regex = /^[A-Z][1-2]\d{8}$/;
    if (!regex.test(nid.toUpperCase())) {
        return false;
    }
  
    // Define weights for the checksum calculation
    const weights = [1, 2, 1, 2, 1, 2, 1, 2, 1];
  
    // Extract the first nine digits
    const digits = nid.slice(1, 10).split('').map(Number);
  
    // Calculate the weighted sum
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        const product = digits[i] * weights[i];
        sum += Math.floor(product / 10) + (product % 10);
    }
  
    // Calculate the checksum digit
    const checksum = (10 - (sum % 10)) % 10;
  
    // Compare with the provided checksum digit
    return checksum === Number(nid[10]);
}
export function isValidNewResidentID(nid:string) {
    // Check if the ID has the correct format
    nid = nid.toUpperCase();
    const regex = /^[A-Z][8-9]\d{8}$/;
    if (!regex.test(nid)) {
        return false;
    }
  
    // Define weights for the checksum calculation
    const weights = [1, 2, 1, 2, 1, 2, 1, 2, 1];
  
    // Extract the first nine digits
    const digits = nid.slice(1, 10).split('').map(Number);
  
    // Calculate the weighted sum
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        const product = digits[i] * weights[i];
        sum += Math.floor(product / 10) + (product % 10);
    }
  
    // Calculate the checksum digit
    const checksum = (10 - (sum % 10)) % 10;
  
    // Compare with the provided checksum digit
    return checksum === Number(nid[10]);
}