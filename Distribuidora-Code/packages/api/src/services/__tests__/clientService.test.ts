import { verifyClientAccessCode } from '../clientService';
import { AppError } from '../../middleware/errorHandler';
import { prisma } from '../../lib/prisma';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    client: {
      findFirst: jest.fn(),
    },
  },
}));

const findFirst = prisma.client.findFirst as jest.Mock;

describe('verifyClientAccessCode', () => {
  const distributorId = 'dist-1';
  // Documento can be a RUT or a Cédula — this helper doesn't care which, it
  // just matches whatever the client was registered with.
  const documento = '76543210-3';

  beforeEach(() => {
    findFirst.mockReset();
  });

  it('rejects when the client does not exist for this distributor', async () => {
    findFirst.mockResolvedValue(null);

    await expect(verifyClientAccessCode(distributorId, documento, 'ANYCODE')).rejects.toMatchObject({
      statusCode: 401,
      message: 'RUT/Cédula no registrado. Contacta a tu distribuidora.',
    } satisfies Partial<AppError>);
  });

  it('rejects when the client exists but is deactivated', async () => {
    findFirst.mockResolvedValue({ active: false, accessCode: 'SOL2026A' });

    await expect(verifyClientAccessCode(distributorId, documento, 'SOL2026A')).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('rejects when the client has no access code assigned yet', async () => {
    findFirst.mockResolvedValue({ active: true, accessCode: null });

    await expect(verifyClientAccessCode(distributorId, documento, 'SOL2026A')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid access code',
    });
  });

  it('rejects a mismatched code', async () => {
    findFirst.mockResolvedValue({ active: true, accessCode: 'SOL2026A' });

    await expect(verifyClientAccessCode(distributorId, documento, 'WRONGCODE')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid access code',
    });
  });

  it('accepts the correct code regardless of case or surrounding whitespace', async () => {
    const client = { active: true, accessCode: 'SOL2026A' };
    findFirst.mockResolvedValue(client);

    await expect(verifyClientAccessCode(distributorId, documento, '  sol2026a  ')).resolves.toBe(
      client
    );
  });

  it('scopes the lookup to the given distributor, matching either rut or cedula', async () => {
    findFirst.mockResolvedValue({ active: true, accessCode: 'X' });

    await verifyClientAccessCode(distributorId, documento, 'X');

    expect(findFirst).toHaveBeenCalledWith({
      where: { distributorId, OR: [{ rut: documento }, { cedula: documento }] },
    });
  });
});
