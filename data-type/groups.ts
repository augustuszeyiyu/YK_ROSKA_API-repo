import { User } from "./users";

export const GroupFrequency = Object.freeze({M:'monthly',B:'biweekly'} as const);
export type GroupFrequencys = typeof GroupFrequency[keyof typeof GroupFrequency];
export interface RoskaSerials {
    sid: uniqid,
    uid: User['uid'],
    member_count: number,
    cycles: number,
    basic_unit_amount: number,
    min_bid_amount: number,
    max_bid_amount: number,
    bid_unit_spacing: number,
    frequency: GroupFrequencys,
    bid_start_time: string,
    bid_end_time: string,
    update_time: string,
    create_time: string,
}
export type RoskaSerialsRequiredInfo = Omit<RoskaSerials, 'sid'|'uid'|'update_time'|'create_time'>;

export interface RoskaGroups {
    gid: uniqid,
    sid: uniqid,
    bid_start_time: string,
    bid_end_time: string,
    update_time: string,
    create_time: string,
}
export type RoskaGroupsRequiredInfo = Omit<RoskaGroups, 'gid'|'sid'|'update_time'|'create_time'>;

export interface RoskaBids {
    mid: uniqid,
    gid: RoskaGroups['gid'],
    sid: RoskaGroups['sid'],
    uid: User['uid'],
    bid_amount: number,
    win: boolean,
    update_time: string,
    create_time: string,
}

export interface RoskaMembers {
    mid: uniqid,
    gid: RoskaGroups['gid'],
    sid: RoskaGroups['sid'],
    uid: User['uid'],
    bid_amount: number,
    win: boolean,
    win_time: string,
    installment_amount: number,
    installment_deadline: string,
    joing_time: string,
    assignment_path: string,
    update_time: string,
    create_time: string,
}

export interface RoskaCandidate {
    uid:RoskaMembers['uid'], 
    mid:RoskaMembers['mid'], 
    gid:RoskaMembers['gid'], 
    sid:RoskaMembers['sid'], 
    bid_amount:RoskaMembers['bid_amount']
}