import { IsString, MaxLength, Matches } from 'class-validator';

// The Push API hands the browser keys as unpadded base64url.
const BASE64URL = /^[A-Za-z0-9_-]+$/;

export class PushSubscribeDto {
  @IsString()
  @MaxLength(2048)
  endpoint: string;

  @IsString()
  @MaxLength(256)
  @Matches(BASE64URL)
  p256dh: string;

  @IsString()
  @MaxLength(128)
  @Matches(BASE64URL)
  auth: string;
}

export class PushUnsubscribeDto {
  @IsString()
  @MaxLength(2048)
  endpoint: string;
}
