import React from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { localAPI, ScheduledMessage, scheduledAPI } from "../services/api";

interface ScheduleFormData {
  contactNumber: string;
  message: string;
  scheduledDate: string;
  scheduledTime: string;
}

export default function ScheduleMessage() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<ScheduleFormData>();

  const watchedDate = watch("scheduledDate");
  const watchedTime = watch("scheduledTime");

  // Função para obter data atual em São Paulo
  const getCurrentDateSP = () => {
    const now = new Date();
    const spDate = new Date(
      now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
    );
    return spDate.toISOString().split("T")[0];
  };

  // Função para obter hora atual em São Paulo
  const getCurrentTimeSP = () => {
    const now = new Date();
    const spTime = new Date(
      now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
    );
    return spTime.toTimeString().slice(0, 5);
  };

  // Função para criar data em São Paulo
  const createDateInSP = (dateString: string, timeString: string) => {
    const [year, month, day] = dateString.split("-").map(Number);
    const [hours, minutes] = timeString.split(":").map(Number);
    const dateTimeString = `${year}-${month.toString().padStart(2, "0")}-${day
      .toString()
      .padStart(2, "0")}T${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:00`;
    return new Date(dateTimeString + "-03:00"); // UTC-3 para São Paulo
  };

  const onSubmit = async (data: ScheduleFormData) => {
    try {
      const config = localAPI.getEvolutionConfig();
      if (!config?.apiUrl || !config?.instanceName || !config?.token) {
        toast.error("Configure a API antes de agendar.");
        return;
      }
      const scheduledAt = createDateInSP(
        data.scheduledDate,
        data.scheduledTime
      );
      const now = new Date();
      const nowSP = new Date(
        now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
      );
      const scheduledSP = new Date(
        scheduledAt.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
      );
      const isToday = scheduledSP.toDateString() === nowSP.toDateString();
      if (isToday) {
        if (scheduledSP.getTime() <= nowSP.getTime()) {
          toast.error("Para hoje, o horário deve ser no futuro (São Paulo)");
          return;
        }
      }
      await scheduledAPI.addScheduledMessage({
        contactNumber: data.contactNumber,
        message: data.message,
        scheduledAt: scheduledAt.toISOString(),
      });
      toast.success("Mensagem agendada!");
      reset();
      navigate("/scheduled-messages");
    } catch (error) {
      toast.error("Erro ao agendar mensagem");
    }
  };

  const getMinDate = () => "";
  const getMinTime = () => {
    if (watchedDate === getCurrentDateSP()) {
      const now = new Date();
      const nowSP = new Date(
        now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
      );
      const futureTime = new Date(nowSP.getTime() + 60000);
      return futureTime.toTimeString().slice(0, 5);
    }
    return "";
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded shadow">
      <h1 className="text-xl font-bold mb-6 text-center">Agendar Mensagem</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label className="block text-sm font-medium">
            Número do WhatsApp
          </label>
          <input
            type="text"
            {...register("contactNumber", {
              required:
                "Digite o número do WhatsApp (apenas números, com DDD e país)",
              pattern: {
                value: /^\d{10,15}$/,
                message: "Número inválido. Ex: 5511999999999",
              },
            })}
            className="input-field"
            placeholder="Ex: 5511999999999"
            autoComplete="off"
          />
          {errors.contactNumber && (
            <p className="mt-1 text-sm text-red-600">
              {errors.contactNumber.message}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium">Mensagem</label>
          <textarea
            {...register("message", {
              required: "Digite a mensagem",
              minLength: {
                value: 1,
                message: "A mensagem não pode estar vazia",
              },
            })}
            rows={4}
            className="input-field"
            placeholder="Digite sua mensagem aqui..."
          />
          {errors.message && (
            <p className="mt-1 text-sm text-red-600">
              {errors.message.message}
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Data</label>
            <input
              type="date"
              {...register("scheduledDate", { required: "Selecione uma data" })}
              min={getMinDate()}
              className="input-field"
            />
            {errors.scheduledDate && (
              <p className="mt-1 text-sm text-red-600">
                {errors.scheduledDate.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium">Hora</label>
            <input
              type="time"
              {...register("scheduledTime", {
                required: "Selecione um horário",
              })}
              min={getMinTime()}
              className="input-field"
            />
            {errors.scheduledTime && (
              <p className="mt-1 text-sm text-red-600">
                {errors.scheduledTime.message}
              </p>
            )}
          </div>
        </div>
        <button
          type="submit"
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 font-semibold"
        >
          Agendar
        </button>
      </form>
    </div>
  );
}
