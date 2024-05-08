export function cal_win_amount(handle_fee:number, interest_bonus:number, trasfer_fee:number, cycles:number, base:number, bid_amount:number, gid:string, trasfer:string) {
    const T = Number(gid.substring(15));
    const remain = cycles - T;

    switch (trasfer) {
        case '': {
            return 0;
        }
        case '0': {
            return (base * T) + ((base-bid_amount) * remain) - (handle_fee * cycles)
        }
        case '1': {
            return (base-handle_fee)*T + interest_bonus - trasfer_fee;
        }
    }
}