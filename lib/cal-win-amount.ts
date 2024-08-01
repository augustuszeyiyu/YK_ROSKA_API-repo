export function cal_win_amount(handle_fee:number, interest_bonus:number, trasfer_fee:number, cycles:number, base:number, bid_amount:number, gid:string, transition:number):{T:number, A:number, transition:number} {
    const T = Number(gid.substring(15));
    const remain = cycles - T;

    if (T === 1 &&T >= 20) transition = 0;

    switch (transition) {
        case 0: {
            if (T < 20) {
                return {
                    T,
                    A: (base * T) + ((base-bid_amount) * remain) - (handle_fee * T),
                    transition: 0,
                };
            }
            else {
                return {
                    T,
                    A: (base * T) + ((base-bid_amount) * remain) - (handle_fee * T) - (base * remain),
                    transition: 2,
                };
            }            
        }
        case 1: {
            if (T < 20) {
                return {
                    T,
                    A: (base-handle_fee)*T + interest_bonus - trasfer_fee,
                    transition: 1,
                };
            }
            else {
                return {
                    T,
                    A: (base * T) + ((base-bid_amount) * remain) - (handle_fee * T) - (base * remain),
                    transition: 2,
                };
            }
        }
        case 2: {
            if (T < 20) {
                return {
                    T,
                    A: (base * T) + ((base-bid_amount) * remain) - (handle_fee * T),
                    transition: 0,
                };
            }
            else {
                return {
                    T,
                    A: (base * T) + ((base-bid_amount) * remain) - (handle_fee * T) - (base * remain),
                    transition: 2,
                };
            }
        }
        default: {
            return {
                T,
                A: 0,
                transition: -1,
            };
        }
    }
}