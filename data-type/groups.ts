export interface RoscaGroups {
    gid: uniqid,
    count: number,
    max_member: number,
    leader_uid: uniqid,
    validate: number,
    cancel_date: number,
    update_time: number,
    create_time: number,
}

export interface RoscaMembers {
    gid: uniqid,
    uid: uniqid,
    serial_number: number,
    update_time: number,
    create_time: number,
}