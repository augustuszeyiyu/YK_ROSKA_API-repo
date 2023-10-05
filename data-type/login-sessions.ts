export interface LoginSession {
	id: uniqid;
	uid: uniqid;
	revoked: boolean;
	login_time: epoch;
	expired_time: epoch;
	create_time: string;
};