import { applicationApi, queryKeys, type JobApplication, type JobApplicationStatus } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Filter,
  PencilLine,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const statusOrder: JobApplicationStatus[] = ["Saved", "Applied", "Screening", "Interview", "Offer", "Rejected", "Withdrawn"];

const emptyForm = {
  company: "",
  role: "",
  status: "Saved" as JobApplicationStatus,
  jobUrl: "",
  location: "",
  notes: "",
  interviewDate: "",
  followUpDate: "",
};

const formatDate = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export function JobApplicationTracker({ onBack }: { onBack: () => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | JobApplicationStatus>("All");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const applicationsQuery = useQuery({
    queryKey: queryKeys.applications,
    queryFn: applicationApi.list,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: applicationApi.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.applications });
      toast.success("Application added.");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Could not save this application.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Omit<JobApplication, "id" | "userId" | "createdAt" | "updatedAt"> }) => applicationApi.update(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.applications });
      toast.success("Application updated.");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Could not update this application.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: applicationApi.remove,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.applications });
      toast.success("Application deleted.");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Could not delete this application.");
    },
  });

  const applications = applicationsQuery.data ?? [];

  const filteredApplications = useMemo(() => {
    const term = search.trim().toLowerCase();
    return applications.filter((application) => {
      const matchesSearch = !term || [application.company, application.role, application.location, application.notes].join(" ").toLowerCase().includes(term);
      const matchesStatus = statusFilter === "All" || application.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [applications, search, statusFilter]);

  const stats = useMemo(() => ({
    total: applications.length,
    interview: applications.filter(item => item.status === "Interview").length,
    offers: applications.filter(item => item.status === "Offer").length,
    saved: applications.filter(item => item.status === "Saved").length,
  }), [applications]);

  const groupedApplications = useMemo(
    () => statusOrder.map((status) => ({ status, items: filteredApplications.filter(item => item.status === status) })),
    [filteredApplications],
  );

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const openNewForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const openEditForm = (application: JobApplication) => {
    setEditingId(application.id);
    setForm({
      company: application.company,
      role: application.role,
      status: application.status,
      jobUrl: application.jobUrl ?? "",
      location: application.location ?? "",
      notes: application.notes ?? "",
      interviewDate: application.interviewDate ?? "",
      followUpDate: application.followUpDate ?? "",
    });
    setShowForm(true);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const company = form.company.trim();
    const role = form.role.trim();

    if (!company || !role) {
      toast.error("Company and role are required.");
      return;
    }

    const payload = {
      company,
      role,
      status: form.status,
      jobUrl: form.jobUrl.trim() || null,
      location: form.location.trim() || null,
      notes: form.notes.trim(),
      interviewDate: form.interviewDate || null,
      followUpDate: form.followUpDate || null,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
    resetForm();
  };

  const handleDelete = (application: JobApplication) => {
    const confirmed = window.confirm(`Delete ${application.company} – ${application.role}?`);
    if (!confirmed) return;
    deleteMutation.mutate(application.id);
  };

  const handleStatusChange = (application: JobApplication, nextStatus: JobApplicationStatus) => {
    const payload = {
      company: application.company,
      role: application.role,
      status: nextStatus,
      jobUrl: application.jobUrl,
      location: application.location,
      notes: application.notes,
      interviewDate: application.interviewDate,
      followUpDate: application.followUpDate,
    };
    updateMutation.mutate({ id: application.id, payload });
  };

  return (
    <div className="subpage application-subpage">
      <div className="subpage-heading">
        <div>
          <p className="eyebrow eyebrow--green"><BriefcaseBusiness size={14} /> JOB APPLICATION TRACKER</p>
          <h1>Keep every opportunity moving.</h1>
          <p>Track outreach, interviews, and offers in one clear workflow.</p>
        </div>
        <button className="quiet-button quiet-button--border" onClick={onBack}><ChevronRight size={15} className="rotate-180" /> Back to overview</button>
      </div>

      <div className="application-stats">
        <div className="application-stat">
          <span>Total</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="application-stat">
          <span>Interviews</span>
          <strong>{stats.interview}</strong>
        </div>
        <div className="application-stat">
          <span>Offers</span>
          <strong>{stats.offers}</strong>
        </div>
        <div className="application-stat">
          <span>Saved</span>
          <strong>{stats.saved}</strong>
        </div>
      </div>

      <div className="application-toolbar">
        <label className="application-search">
          <Search size={14} />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search company, role or notes" aria-label="Search applications" />
        </label>

        <label className="application-filter">
          <Filter size={14} />
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as "All" | JobApplicationStatus)} aria-label="Filter applications by status">
            <option value="All">All statuses</option>
            {statusOrder.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>

        <button className="primary-button" onClick={openNewForm}><Plus size={16} /> Add application</button>
      </div>

      {applicationsQuery.isLoading ? (
        <div className="admin-empty"><strong>Loading applications…</strong><p>Syncing your job pipeline.</p></div>
      ) : applicationsQuery.isError ? (
        <div className="admin-empty"><strong>We could not load your tracker.</strong><p>Please refresh and try again.</p></div>
      ) : groupedApplications.every(column => column.items.length === 0) ? (
        <div className="admin-empty">
          <strong>No applications yet</strong>
          <p>Add your first role to start tracking interviews, follow-ups and offer stages.</p>
        </div>
      ) : (
        <div className="application-kanban">
          {groupedApplications.map(({ status, items }) => (
            <div key={status} className="application-column">
              <div className="application-column__header">
                <strong>{status}</strong>
                <span>{items.length}</span>
              </div>

              <div className="application-column__body">
                {items.length === 0 ? (
                  <div className="application-column__empty">No items</div>
                ) : (
                  items.map((application) => (
                    <article key={application.id} className="application-card">
                      <div className="application-card__row">
                        <div>
                          <h3>{application.company}</h3>
                          <p>{application.role}</p>
                        </div>
                        <button className="icon-button" onClick={() => openEditForm(application)} aria-label={`Edit ${application.company}`} title="Edit">
                          <PencilLine size={14} />
                        </button>
                      </div>

                      <div className="application-card__meta">
                        <span><CalendarClock size={12} /> {formatDate(application.interviewDate)}</span>
                        <span>Follow-up: {formatDate(application.followUpDate)}</span>
                      </div>

                      {application.location ? <div className="application-card__location">{application.location}</div> : null}
                      {application.jobUrl ? (
                        <a className="application-link" href={application.jobUrl} target="_blank" rel="noreferrer">Open listing</a>
                      ) : null}
                      {application.notes ? <p className="application-notes">{application.notes}</p> : null}

                      <div className="application-card__actions">
                        <select
                          value={application.status}
                          onChange={event => handleStatusChange(application, event.target.value as JobApplicationStatus)}
                          aria-label={`Update status for ${application.company}`}
                        >
                          {statusOrder.map(option => <option key={option} value={option}>{option}</option>)}
                        </select>
                        <button className="danger-button" onClick={() => handleDelete(application)} aria-label={`Delete ${application.company}`}>
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="modal-backdrop" onClick={resetForm}>
          <div className="modal-card" onClick={event => event.stopPropagation()}>
            <div className="modal-card__header">
              <div>
                <p className="eyebrow eyebrow--green"><CheckCircle2 size={12} /> {editingId ? "EDIT APPLICATION" : "NEW APPLICATION"}</p>
                <h2>{editingId ? "Update application" : "Add application"}</h2>
              </div>
              <button className="icon-button" onClick={resetForm} aria-label="Close form"><X size={16} /></button>
            </div>

            <form className="application-form" onSubmit={handleSubmit}>
              <div className="application-form__grid">
                <label>
                  Company
                  <input value={form.company} onChange={event => setForm(current => ({ ...current, company: event.target.value }))} placeholder="Google" />
                </label>
                <label>
                  Role
                  <input value={form.role} onChange={event => setForm(current => ({ ...current, role: event.target.value }))} placeholder="Frontend Engineer" />
                </label>
                <label>
                  Status
                  <select value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value as JobApplicationStatus }))}>
                    {statusOrder.map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <label>
                  Location
                  <input value={form.location} onChange={event => setForm(current => ({ ...current, location: event.target.value }))} placeholder="Bengaluru, India" />
                </label>
                <label>
                  Job URL
                  <input value={form.jobUrl} onChange={event => setForm(current => ({ ...current, jobUrl: event.target.value }))} placeholder="https://..." />
                </label>
                <label>
                  Interview date
                  <input type="date" value={form.interviewDate} onChange={event => setForm(current => ({ ...current, interviewDate: event.target.value }))} />
                </label>
                <label>
                  Follow-up date
                  <input type="date" value={form.followUpDate} onChange={event => setForm(current => ({ ...current, followUpDate: event.target.value }))} />
                </label>
              </div>

              <label className="application-form__notes">
                Notes
                <textarea value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} placeholder="Keep notes about the role, recruiter, or next step." rows={4} />
              </label>

              <div className="application-form__actions">
                <button type="button" className="quiet-button quiet-button--border" onClick={resetForm}>Cancel</button>
                <button type="submit" className="primary-button" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? (updateMutation.isPending ? "Saving…" : "Save changes") : (createMutation.isPending ? "Saving…" : "Add application")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
