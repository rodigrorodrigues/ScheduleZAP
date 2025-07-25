import React, { useState } from "react";

const getUserConfig = () => {
  const data = localStorage.getItem("user_config");
  if (data) return JSON.parse(data);
  return { password: "" };
};

const setUserConfig = (config: { password: string }) => {
  localStorage.setItem("user_config", JSON.stringify(config));
};

export default function UserConfig() {
  const [password, setPassword] = useState(getUserConfig().password);
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUserConfig({ password });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Alterar Senha</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Nova senha</label>
          <input
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full border rounded px-2 py-1"
            autoComplete="new-password"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Salvar
        </button>
        {saved && <div className="text-green-600 text-sm">Senha alterada!</div>}
      </form>
    </div>
  );
}
