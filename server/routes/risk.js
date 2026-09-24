import express from 'express';
import { RISK_CONTROLS, RISK_FUNCTIONS, RISK_RESPONSES } from '../../shared/riskCatalog.js';
import {
  createAssessment,
  getAssessment,
  getRiskOverview,
  listAssessments,
  listFindings,
  updateAssessment,
  updateFindingStatus,
} from '../utils/riskHelpers.js';

export function createRiskRouter() {
  const router = express.Router();

  router.get('/overview', async (_req, res) => {
    try {
      const data = await getRiskOverview();
      res.json({ ok: true, data });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  router.get('/catalog', (_req, res) => {
    res.json({
      ok: true,
      data: {
        functions: RISK_FUNCTIONS,
        controls: RISK_CONTROLS,
        responses: RISK_RESPONSES,
      },
    });
  });

  router.get('/assessments', async (_req, res) => {
    try {
      const data = await listAssessments();
      res.json({ ok: true, data });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  router.post('/assessments', async (req, res) => {
    try {
      const data = await createAssessment({
        title: req.body?.title,
        assessorName: req.body?.assessorName,
        createdBy: req.adminClaims?.sub || null,
      });
      res.status(201).json({ ok: true, data });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  router.get('/assessments/:id', async (req, res) => {
    try {
      const data = await getAssessment(req.params.id);
      res.json({ ok: true, data });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  router.put('/assessments/:id', async (req, res) => {
    try {
      const data = await updateAssessment(req.params.id, req.body || {});
      res.json({ ok: true, data });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  router.get('/findings', async (req, res) => {
    try {
      const data = await listFindings({ status: req.query?.status || '' });
      res.json({ ok: true, data });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  router.patch('/findings/:id', async (req, res) => {
    try {
      const data = await updateFindingStatus(req.params.id, req.body?.status);
      res.json({ ok: true, data });
    } catch (error) {
      res.status(error?.status || 500).json({ ok: false, message: error.message });
    }
  });

  return router;
}
