export const NUM_DECIMAL_FORMAT = /^([0-9]+\.?[0-9]*|\.[0-9]+)$/;
export const NUM_STR_FORMAT = /^(-?)([0-9]|[1-9][0-9]+)(\.([0-9]|[0-9]+[1-9]))?$/u;
export const NUM_POSSITIVE_STR_FORMAT = /^([0-9]|[1-9][0-9]+)(\.([0-9]|[0-9]+[1-9]))?$/u;
export const NUM_MEGATIVE_STR_FORMAT = /^-([0-9]|[1-9][0-9]+)(\.([0-9]|[0-9]+[1-9]))?$/u;

export const INT_STR_FORMAT = /^(-?)([0-9]|[1-9][0-9]+)$/u;
export const INT_POSSITIVE_STR_FORMAT = /^([0-9]|[1-9][0-9]+)$/u;
export const INT_NEGATIVE_STR_FORMAT = /^-([0-9]|[1-9][0-9]+)$/u;

export const STR_LETTER_NUMBER_FORMAT = /^[A-Za-z0-9]*$/;
export const STR_NUMBER_FORMAT = /^[0-9]*$/;

export const MAX_INTEGER_32 = 0x7FFFFFFF;



function RegExpEscape(str:string):string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
export function GenWhiteListPattern(candidates:string[]) {
	return new RegExp(`^(${candidates.map(RegExpEscape).join('|')})$`, 'u');
}
