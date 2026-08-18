import { validate } from 'class-validator';
import { CreateUserDto, UpdateUserDto } from './users.dto';

describe('CreateUserDto', () => {
  it('accepts female/male gender', async () => {
    const dto = new CreateUserDto();
    Object.assign(dto, { email: 'a@b.com', firstName: 'A', lastName: 'B', password: 'Password123!', gender: 'female' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('rejects an invalid gender value', async () => {
    const dto = new CreateUserDto();
    Object.assign(dto, { email: 'a@b.com', firstName: 'A', lastName: 'B', password: 'Password123!', gender: 'unknown' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'gender')).toBe(true);
  });

  it('requires gender on create', async () => {
    const dto = new CreateUserDto();
    Object.assign(dto, { email: 'a@b.com', firstName: 'A', lastName: 'B', password: 'Password123!' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'gender')).toBe(true);
  });
});

describe('UpdateUserDto', () => {
  it('allows gender to be omitted', async () => {
    const dto = new UpdateUserDto();
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});