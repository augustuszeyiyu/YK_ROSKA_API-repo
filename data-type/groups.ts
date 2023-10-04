import { User } from "./users";

export interface RoskaSerials {
    sid: uniqid,
    uid: User['uid'],
    basic_unit_amount: number,
    min_bid_amount: number,
    max_bid_amount: number,
    bid_unit_spacing: number,
    g_frequency: number,
    update_time: epoch,
    create_time: epoch,
}
export type RoskaSerialsRequiredInfo = Omit<RoskaSerials, 'sid'|'uid'|'update_time'|'create_time'>;

export interface RoskaGroups {
    gid: uniqid,
    sid: uniqid,
    bit_start_time: number,
    bit_end_time: number,
    update_time: epoch,
    create_time: epoch,
}
export type RoskaGroupsRequiredInfo = Omit<RoskaGroups, 'gid'|'sid'|'update_time'|'create_time'>;

export interface RoskaMembers {
    mid: uniqid,
    gid: RoskaGroups['gid'],
    sid: RoskaGroups['sid'],
    uid: User['uid'],
    bid_amount: number,
    win: boolean,
    win_time: epoch,
    installment_amount: number,
    installment_deadline: epoch,
    joing_time: epoch,
    assignment_path: string,
    update_time: epoch,
    create_time: epoch,
}