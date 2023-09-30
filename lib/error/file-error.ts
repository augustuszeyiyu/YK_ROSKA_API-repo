export class FileError {
	public static NO_UPLOAD_FILE:HuntErrorItem = {
		status:400, code:'api#file#no-upload-file',
		msg:'No Upload File!'
	};
    public static MAXIMUM_UPLOAD_SIZE_EXCEEDED:HuntErrorItem = {
        status:413, code:'api#file#maximum_upload_size_exceeded',
		msg:'Maximum upload size exceeded!'
    };
    public static UNSUPPORTED_MIME_TYPE:HuntErrorItem = {
        status:400, code:'api#file#unsupported_mime_type',
		msg:'Only images are accepted!'
    }
};
