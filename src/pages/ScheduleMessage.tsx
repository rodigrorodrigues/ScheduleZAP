import React from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { localAPI, scheduledAPI } from "../services/api";
import { FormInput } from "../components/FormInput";
import { FormTextarea } from "../components/FormTextarea";
import {
  getCurrentDateSP,
  getCurrentTimeSP,
  createDateInSP,
  validateScheduledDateTime,
} from "../utils/dateTime";

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

  const onSubmit = async (data: ScheduleFormData) => {
    try {
      const config = localAPI.getEvolutionConfig();
      if (!config?.apiUrl || !config?.instanceName || !config?.token) {
        toast.error("Configure a API antes de agendar.");
        return;
      }
      
      const scheduledAt = createDateInSP(data.scheduledDate, data.scheduledTime);
      
      // Validate the scheduled date/time
      const validation = validateScheduledDateTime(data.scheduledDate, data.scheduledTime);
      if (!validation.isValid) {
        toast.error(validation.error || "Data/hora inválida");
        return;
      }
      
      await scheduledAPI.addScheduledMessage({
        contactNumber: data.contactNumber,
        message: data.message,
        scheduledAt: scheduledAt.toISOString(),
      });
      toast.success("Mensagem agendada!");
      reset();
      navigate("/");
    } catch (error) {
      toast.error("Erro ao agendar mensagem");
    }
  };

  const getMinDate = () => "";
  const getMinTime = () => {
    if (watchedDate === getCurrentDateSP()) {
      const currentTime = getCurrentTimeSP();
      // Add 1 minute to ensure the scheduled time is in the future
      const [hours, minutes] = currentTime.split(":").map(Number);
      const futureMinutes = minutes + 1;
      const futureHours = hours + Math.floor(futureMinutes / 60);
      const adjustedMinutes = futureMinutes % 60;
      return `${futureHours.toString().padStart(2, "0")}:${adjustedMinutes.toString().padStart(2, "0")}`;
    }
    return "";
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded shadow">
      <h1 className="text-xl font-bold mb-6 text-center">Agendar Mensagem</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormInput
          label="Número do WhatsApp"
          type="text"
          placeholder="Ex: 5511999999999"
          autoComplete="off"
          {...register("contactNumber", {
            required:
              "Digite o número do WhatsApp (apenas números, com DDD e país)",
            pattern: {
              value: /^\d{10,15}$/,
              message: "Número inválido. Ex: 5511999999999",
            },
          })}
          error={errors.contactNumber?.message}
        />
        
        <FormTextarea
          label="Mensagem"
          rows={4}
          placeholder="Digite sua mensagem aqui..."
          {...register("message", {
            required: "Digite a mensagem",
            minLength: {
              value: 1,
              message: "A mensagem não pode estar vazia",
            },
          })}
          error={errors.message?.message}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Data"
            type="date"
            min={getMinDate()}
            {...register("scheduledDate", { required: "Selecione uma data" })}
            error={errors.scheduledDate?.message}
          />
          
          <FormInput
            label="Hora"
            type="time"
            min={getMinTime()}
            {...register("scheduledTime", {
              required: "Selecione um horário",
            })}
            error={errors.scheduledTime?.message}
          />
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
