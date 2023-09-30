export interface SessionInfo {
	id: uniqid;
	uid: uniqid;
	revoked: boolean;
	login_time: epoch;
	expired_time: epoch;
	create_time: epoch;
};