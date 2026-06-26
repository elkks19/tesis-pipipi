"use client";

import { useState } from "react";
import {
  ActivityIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  ClipboardListIcon,
  EyeIcon,
  FileCheck2Icon,
  FileTextIcon,
  FlaskConicalIcon,
  HeartPulseIcon,
  ImageIcon,
  PaperclipIcon,
  ScanLineIcon,
  StethoscopeIcon,
  UserRoundIcon,
  WindIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { useIsMobile } from "@/hooks/use-mobile";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { PacienteSearchResult } from "@/lib/pacientes/search-types";
import type { Historia } from "@/lib/schema/historia";
