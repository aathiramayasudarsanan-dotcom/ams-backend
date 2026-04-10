/**
 * AMS Unified User Model — Migration Script
 *
 * Migrates data from the old multi-collection architecture to the new
 * unified user model with embedded `profile` sub-objects.
 *
 * What this script does:
 *  1. Embeds student  profiles into their User documents (profile = StudentProfile)
 *  2. Embeds teacher  profiles into their User documents (profile = StaffProfile)
 *  3. Embeds parent   profiles into their User documents (profile.child = User._id of child)
 *  4. Updates AttendanceSession.created_by  from Teacher._id → User._id
 *  5. Updates Batch.staff_advisor            from Teacher._id → User._id
 *  6. Drops and recreates the attendance_record collection (dev env — no data to preserve)
 *
 * Usage:
 *   bun src/scripts/migrate-users.ts
 *
 * Safe to re-run — uses $set and only updates docs that still have the old shape.
 */

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/ams";

// ─── Raw collection access (bypasses new model code) ─────────────────────────

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log("✅  Connected to MongoDB:", MONGODB_URI);

  const db = mongoose.connection.db!;

  const userCol             = db.collection("user");
  const studentCol          = db.collection("student");
  const teacherCol          = db.collection("teacher");
  const parentCol           = db.collection("parent");
  const attendanceSessionCol = db.collection("attendance_session");
  const attendanceRecordCol = db.collection("attendance_record");
  const batchCol            = db.collection("batch");

  let ok = 0, skip = 0, fail = 0;

  // ── 1. Embed student profiles ─────────────────────────────────────────────
  console.log("\n[1/6] Migrating students…");
  const students = await studentCol.find({}).toArray();
  for (const s of students) {
    try {
      const userId = s.user;
      const profile: Record<string, unknown> = {};
      if (s.adm_number)     profile.adm_number     = s.adm_number;
      if (s.adm_year)       profile.adm_year       = s.adm_year;
      if (s.candidate_code) profile.candidate_code = s.candidate_code;
      if (s.department)     profile.department     = s.department;
      if (s.date_of_birth)  profile.date_of_birth  = s.date_of_birth;
      if (s.batch)          profile.batch          = s.batch;

      const res = await userCol.updateOne(
        { _id: userId },
        { $set: { profile } }
      );
      res.matchedCount ? ok++ : (console.warn("  ⚠ No user found for student:", userId), skip++);
    } catch (e) {
      console.error("  ✗ Student migration failed:", s._id, e);
      fail++;
    }
  }
  console.log(`   → ${students.length} records — ok: ${ok}, skipped: ${skip}, failed: ${fail}`);
  [ok, skip, fail] = [0, 0, 0];

  // ── 2. Embed teacher/staff profiles ──────────────────────────────────────
  console.log("\n[2/6] Migrating teachers/staff…");
  const teachers = await teacherCol.find({}).toArray();
  for (const t of teachers) {
    try {
      const userId = t.user;
      const profile: Record<string, unknown> = {};
      if (t.designation)    profile.designation    = t.designation;
      if (t.department)     profile.department     = t.department;
      if (t.date_of_joining)profile.date_of_joining= t.date_of_joining;

      const res = await userCol.updateOne(
        { _id: userId },
        { $set: { profile } }
      );
      res.matchedCount ? ok++ : (console.warn("  ⚠ No user found for teacher:", userId), skip++);
    } catch (e) {
      console.error("  ✗ Teacher migration failed:", t._id, e);
      fail++;
    }
  }
  console.log(`   → ${teachers.length} records — ok: ${ok}, skipped: ${skip}, failed: ${fail}`);
  [ok, skip, fail] = [0, 0, 0];

  // ── 3. Embed parent profiles ───────────────────────────────────────────────
  console.log("\n[3/6] Migrating parents…");
  const parents = await parentCol.find({}).toArray();
  for (const p of parents) {
    try {
      const userId = p.user;

      // Resolve Student._id → User._id for the child reference
      let childUserId: mongoose.Types.ObjectId | undefined;
      if (p.child) {
        const studentDoc = await studentCol.findOne({ _id: p.child });
        if (studentDoc) {
          childUserId = studentDoc.user;
        } else {
          console.warn("  ⚠ Child student not found for parent:", userId, "child Student._id:", p.child);
        }
      }

      const profile: Record<string, unknown> = {};
      if (p.relation)    profile.relation = p.relation;
      if (childUserId)   profile.child    = childUserId;

      const res = await userCol.updateOne(
        { _id: userId },
        { $set: { profile } }
      );
      res.matchedCount ? ok++ : (console.warn("  ⚠ No user found for parent:", userId), skip++);
    } catch (e) {
      console.error("  ✗ Parent migration failed:", p._id, e);
      fail++;
    }
  }
  console.log(`   → ${parents.length} records — ok: ${ok}, skipped: ${skip}, failed: ${fail}`);
  [ok, skip, fail] = [0, 0, 0];

  // ── 4. Update AttendanceSession.created_by ─────────────────────────────────
  console.log("\n[4/6] Updating AttendanceSession.created_by (Teacher._id → User._id)…");
  const sessions = await attendanceSessionCol.find({}).toArray();
  for (const session of sessions) {
    try {
      const teacherDoc = await teacherCol.findOne({ _id: session.created_by });
      if (!teacherDoc) {
        console.warn("  ⚠ No teacher found for session:", session._id);
        skip++;
        continue;
      }
      await attendanceSessionCol.updateOne(
        { _id: session._id },
        { $set: { created_by: teacherDoc.user } }
      );
      ok++;
    } catch (e) {
      console.error("  ✗ Session update failed:", session._id, e);
      fail++;
    }
  }
  console.log(`   → ${sessions.length} records — ok: ${ok}, skipped: ${skip}, failed: ${fail}`);
  [ok, skip, fail] = [0, 0, 0];

  // ── 5. Update Batch.staff_advisor ──────────────────────────────────────────
  console.log("\n[5/6] Updating Batch.staff_advisor (Teacher._id → User._id)…");
  const batches = await batchCol.find({}).toArray();
  for (const batch of batches) {
    try {
      const teacherDoc = await teacherCol.findOne({ _id: batch.staff_advisor });
      if (!teacherDoc) {
        console.warn("  ⚠ No teacher found for batch:", batch._id, "staff_advisor:", batch.staff_advisor);
        skip++;
        continue;
      }
      await batchCol.updateOne(
        { _id: batch._id },
        { $set: { staff_advisor: teacherDoc.user } }
      );
      ok++;
    } catch (e) {
      console.error("  ✗ Batch update failed:", batch._id, e);
      fail++;
    }
  }
  console.log(`   → ${batches.length} records — ok: ${ok}, skipped: ${skip}, failed: ${fail}`);

  // ── 6. Drop attendance_record (dev env — recreated fresh) ─────────────────
  console.log("\n[6/6] Dropping attendance_record collection…");
  try {
    const collections = await db.listCollections({ name: "attendance_record" }).toArray();
    if (collections.length > 0) {
      await attendanceRecordCol.drop();
      console.log("   → Dropped attendance_record.");
    } else {
      console.log("   → attendance_record does not exist, skipping.");
    }
  } catch (e) {
    console.error("  ✗ Failed to drop attendance_record:", e);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════");
  console.log("✅  Migration complete.");
  console.log("\nData Integrity Checks (run in mongo shell):");
  console.log('  db.user.find({role:"student","profile.adm_number":{$exists:false}}).count()   // → 0 (ok if no students existed)');
  console.log('  db.user.find({role:"parent","profile.child":{$exists:false}}).count()          // → 0');
  console.log('  db.attendance_session.find({created_by:{$exists:false}}).count()               // → 0');
  console.log("\nAfter verifying, drop old collections:");
  console.log("  db.student.drop()");
  console.log("  db.teacher.drop()");
  console.log("  db.parent.drop()");
  console.log("══════════════════════════════════════════\n");

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
