-- El campo "categories" (rubros) era del autoregistro público de
-- distribuidoras, que ya no existe (el alta ahora la hace el superadmin a
-- mano y no pide rubros). Ninguna pantalla actual lo carga ni lo usa para
-- filtrar, así que se elimina en vez de dejarlo como dato muerto.
ALTER TABLE "Distributor" DROP COLUMN "categories";
