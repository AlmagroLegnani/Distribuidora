export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">StockApp</h1>
        <p className="text-gray-500 mt-2">
          Accede al portal de tu proveedor usando su URL personalizada.
        </p>
        <p className="text-sm text-gray-400 mt-4">
          Ejemplo: <code className="bg-gray-100 px-2 py-1 rounded">/demo</code>
        </p>
      </div>
    </div>
  );
}
