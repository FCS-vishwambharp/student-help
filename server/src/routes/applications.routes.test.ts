import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import mongoose from "mongoose";
import test from "node:test";
import { closeDb, connectDb, ApplicationModel } from "../db";
import applicationsRouter from "./applications.routes";

async function bootServer(user: { id: string; role?: string; email?: string }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      _id: new mongoose.Types.ObjectId(user.id),
      id: user.id,
      role: user.role ?? "user",
      email: user.email ?? "user@example.com",
    };
    next();
  });
  app.use("/api/applications", applicationsRouter);
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start test server");
  }
  return { server, port: address.port };
}

test.before(async () => {
  await connectDb();
  await ApplicationModel.deleteMany({});
});

test.after(async () => {
  await ApplicationModel.deleteMany({});
  await closeDb();
});

test("create application stores the authenticated user id", async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const serverInfo = await bootServer({ id: userId, role: "user" });
  try {
    const response = await fetch(`http://127.0.0.1:${serverInfo.port}/api/applications`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        company: "Acme",
        role: "Frontend Engineer",
        status: "Saved",
        notes: "Interested in the role",
      }),
    });

    assert.equal(response.status, 201);
    const body = (await response.json()) as any;
    assert.equal(String(body.userId), userId);
    assert.equal(body.company, "Acme");

    const count = await ApplicationModel.countDocuments({ userId: new mongoose.Types.ObjectId(userId) });
    assert.equal(count, 1);
  } finally {
    await new Promise(resolve => serverInfo.server.close(resolve));
  }
});

test("update application changes the requested record only", async () => {
  const userId = new mongoose.Types.ObjectId();
  const record = await ApplicationModel.create({
    userId,
    company: "Stripe",
    role: "Product Engineer",
    status: "Saved",
    notes: "Initial application",
  });

  const serverInfo = await bootServer({ id: userId.toString(), role: "user" });
  try {
    const response = await fetch(`http://127.0.0.1:${serverInfo.port}/api/applications/${record._id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        company: "Stripe",
        role: "Senior Product Engineer",
        status: "Interview",
        notes: "Screening call scheduled",
        jobUrl: "https://jobs.example.com/123",
        location: "Remote",
        interviewDate: "2026-11-02",
        followUpDate: "2026-11-04",
      }),
    });

    assert.equal(response.status, 200);
    const body = (await response.json()) as any;
    assert.equal(body.role, "Senior Product Engineer");
    assert.equal(body.status, "Interview");
    const updated = (await ApplicationModel.findById(record._id).lean()) as any;
    assert.equal(updated?.status, "Interview");
  } finally {
    await new Promise(resolve => serverInfo.server.close(resolve));
  }
});

test("delete application removes the authenticated user record", async () => {
  const userId = new mongoose.Types.ObjectId();
  const record = await ApplicationModel.create({
    userId,
    company: "Notion",
    role: "Design Engineer",
    status: "Applied",
  });

  const serverInfo = await bootServer({ id: userId.toString(), role: "user" });
  try {
    const response = await fetch(`http://127.0.0.1:${serverInfo.port}/api/applications/${record._id}`, {
      method: "DELETE",
    });

    assert.equal(response.status, 200);
    const body = (await response.json()) as any;
    assert.equal(body.success, true);
    const after = (await ApplicationModel.findById(record._id).lean()) as any;
    assert.equal(after, null);
  } finally {
    await new Promise(resolve => serverInfo.server.close(resolve));
  }
});
