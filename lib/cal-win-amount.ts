export function cal_win_amount(handle_fee:number, interest_bonus:number, trasfer_fee:number, cycles:number, base:number, bid_amount:number, gid:string, trasfer:number) {
    const T = Number(gid.substring(15));
    const remain = cycles - T;

    if (T === 1 &&T >= 20) trasfer = 0;

    switch (trasfer) {
        case 0: {
            if (T < 20) {
                return (base * T) + ((base-bid_amount) * remain) - (handle_fee * T);
            }
            else {
                return (base * T) + ((base-bid_amount) * remain) - (handle_fee * T) - (base * remain);
            }
        }
        case 1: {
            return (base-handle_fee)*T + interest_bonus - trasfer_fee;
        }
        default: {
            return 0;
        }
    }
}