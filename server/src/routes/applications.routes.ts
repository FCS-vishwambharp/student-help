import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth, type AuthedRequest } from "../auth";
import { ApplicationModel } from "../db";

const router = Router();
const statusValues = ["Saved", "Applied", "Screening", "Interview", "Offer", "Rejected", "Withdrawn"] as const;

const applicationInputSchema = z.object({
  company: z.string().trim().min(1, "Company is required").max(120),
  role: z.string().trim().min(1, "Role is required").max(120),
  status: z.enum(statusValues).default("Saved"),
  jobUrl: z.string().trim().max(500).nullable().optional().transform(value => value && value.length > 0 ? value : null),
  location: z.string().trim().max(120).nullable().optional().transform(value => value && value.length > 0 ? value : null),
  notes: z.string().trim().max(2000).optional().default(""),
  interviewDate: z.string().nullable().optional().transform(value => value && value.length > 0 ? value : null),
  followUpDate: z.string().nullable().optional().transform(value => value && value.length > 0 ? value : null),
});

const serializeApplication = (item: any) => ({
  id: String(item._id),
  userId: String(item.userId),
  company: item.company,
  role: item.role,
  status: item.status,
  jobUrl: item.jobUrl ?? null,
  location: item.location ?? null,
  notes: item.notes ?? "",
  interviewDate: item.interviewDate ? new Date(item.interviewDate).toISOString() : null,
  followUpDate: item.followUpDate ? new Date(item.followUpDate).toISOString() : null,
  createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString(),
  updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
});

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user!;
  const records = await ApplicationModel.find({ userId: user._id }).sort({ updatedAt: -1 }).lean();
  res.json(records.map(serializeApplication));
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user!;
  const parsed = applicationInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid application payload" });
    return;
  }

  const payload = parsed.data;
  const created = await ApplicationModel.create({
    userId: user._id,
    company: payload.company,
    role: payload.role,
    status: payload.status,
    jobUrl: payload.jobUrl,
    location: payload.location,
    notes: payload.notes,
    interviewDate: payload.interviewDate ? new Date(payload.interviewDate) : null,
    followUpDate: payload.followUpDate ? new Date(payload.followUpDate) : null,
  });

  res.status(201).json(serializeApplication(created.toObject ? created.toObject() : created));
});

router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user!;
  const parsed = applicationInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid application payload" });
    return;
  }

  const record = await ApplicationModel.findOne({ _id: req.params.id, userId: user._id });
  if (!record) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  const payload = parsed.data;
  const updated = await ApplicationModel.findOneAndUpdate(
    { _id: record._id, userId: user._id },
    {
      $set: {
        company: payload.company,
        role: payload.role,
        status: payload.status,
        jobUrl: payload.jobUrl,
        location: payload.location,
        notes: payload.notes,
        interviewDate: payload.interviewDate ? new Date(payload.interviewDate) : null,
        followUpDate: payload.followUpDate ? new Date(payload.followUpDate) : null,
      },
    },
    { new: true },
  );

  if (!updated) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  res.json(serializeApplication(updated.toObject ? updated.toObject() : updated));
});

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user!;
  const deleted = await ApplicationModel.findOneAndDelete({ _id: req.params.id, userId: user._id });
  if (!deleted) {
    res.status(404).json({ error: "Application not found" });
    return;
  }
  res.json({ success: true, id: String(deleted._id) });
});

export default router;
