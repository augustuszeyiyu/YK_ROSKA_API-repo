export default class Validator {
	static checkEmailFormat(input_string:string):boolean {
		input_string = (''+input_string).trim();
		const email_syntax = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
		return email_syntax.test(input_string);
	};
	static checkPasswordFormat(input_string:string):boolean {
		input_string = ('' + input_string).trim();
		const  strongRegex = /^(?=.*[a-zA-Z])(?=.*[0-9])(?=.{6,})/;
		return strongRegex.test(input_string);
	}
}