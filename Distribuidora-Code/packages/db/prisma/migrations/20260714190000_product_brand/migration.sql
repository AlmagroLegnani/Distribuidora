-- Agrega la marca del producto (ej. "Aceite Vegetal 1L" puede tener varias marcas
-- distintas). Se usa tanto para mostrarla en el backoffice como para poder
-- filtrar el catálogo público por marca.

ALTER TABLE "Product" ADD COLUMN "brand" TEXT;
