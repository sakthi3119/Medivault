import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/axios";

export function useRecords({ type = "All", search = "", page = 1, limit = 12 } = {}) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const query = useMemo(
    () => ({ type, search, page, limit }),
    [type, search, page, limit]
  );

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/records", { params: query });
      setItems(data.items || []);
      setPagination(data.pagination || pagination);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load records.");
    } finally {
      setLoading(false);
    }
  }, [query, pagination]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const createRecord = useCallback(async (formData, onUploadProgress) => {
    try {
      const { data } = await api.post("/api/records", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress,
      });
      return { ok: true, record: data.record };
    } catch (err) {
      return { ok: false, message: err?.response?.data?.message || "Upload failed." };
    }
  }, []);

  const deleteRecord = useCallback(async (id) => {
    try {
      await api.delete(`/api/records/${id}`);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err?.response?.data?.message || "Delete failed." };
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get("/api/records/stats");
      return { ok: true, data };
    } catch (err) {
      return { ok: false, message: err?.response?.data?.message || "Failed to load stats." };
    }
  }, []);

  const fetchTimeline = useCallback(async () => {
    try {
      const { data } = await api.get("/api/records/timeline");
      return { ok: true, data };
    } catch (err) {
      return { ok: false, message: err?.response?.data?.message || "Failed to load timeline." };
    }
  }, []);

  return { items, pagination, loading, error, fetchRecords, createRecord, deleteRecord, fetchStats, fetchTimeline };
}

