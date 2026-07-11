import { verifyClientAccessCode } from '../clientService';
import { AppError } from '../../middleware/errorHandler';
import { prisma } from '../../lib/prisma';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    client: {
      findUnique: jest.fn(),
    },
  },
}));

const findUnique = prisma.client.findUnique as jest.Mock;

describe('verifyClientAccessCode', () => {
  const distributorId = 'dist-1';
  const rut = '76543210-3';

  beforeEach(() => {
    findUnique.mockReset();
  });

  it('rejects when the client does not exist for this distributor', async () => {
    findUnique.mockResolvedValue(null);

    await expect(verifyClientAccessCode(distributorId, rut, 'ANYCODE')).rejects.toMatchObject({
      statusCode: 401,
      message: 'RUT no registrado. Contacta a tu distribuidora.',
    } satisfies Partial<AppError>);
  });

  it('rejects when the client exists but is deactivated', async () => {
    findUnique.mockResolvedValue({ active: false, accessCode: 'SOL2026A' });

    await expect(verifyClientAccessCode(distributorId, rut, 'SOL2026A')).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('rejects when the client has no access code assigned yet', async () => {
    findUnique.mockResolvedValue({ active: true, accessCode: null });

    await expect(verifyClientAccessCode(distributorId, rut, 'SOL2026A')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid access code',
    });
  });

  it('rejects a mismatched code', async () => {
    findUnique.mockResolvedValue({ active: true, accessCode: 'SOL2026A' });

    await expect(verifyClientAccessCode(distributorId, rut, 'WRONGCODE')).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid access code',
    });
  });

  it('accepts the correct code regardless of case or surrounding whitespace', async () => {
    const client = { active: true, accessCode: 'SOL2026A' };
    findUnique.mockResolvedValue(client);

    await expect(verifyClientAccessCode(distributorId, rut, '  sol2026a  ')).resolves.toBe(
      client
    );
  });

  it('scopes the lookup to the given distributor and rut', async () => {
    findUnique.mockResolvedValue({ active: true, accessCode: 'X' });

    await verifyClientAccessCode(distributorId, rut, 'X');

    expect(findUnique).toHaveBeenCalledWith({
      where: { distributorId_rut: { distributorId, rut } },
    });
  });
});
