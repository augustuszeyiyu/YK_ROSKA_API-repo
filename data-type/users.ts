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
    role: 'admin'|'user'|'volunteer',
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
    referrer_nid:User['nid'], volunteer_nid:User['nid']
};