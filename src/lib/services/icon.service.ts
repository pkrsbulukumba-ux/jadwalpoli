import {
	Heart,
	Brain,
	Shield,
	Eye,
	Bone,
	Wind,
	Zap,
	Ear,
	Scissors,
	Accessibility,
	Baby,
	Bandage,
	Stethoscope,
	HeartPulse,
	Users,
	ZapOff,
	Apple,
	Sparkles,
	SmilePlus,
	Smile,
	Activity,
	ClipboardCheck,
	Scan,
	Microscope
} from '@lucide/svelte';

export interface PoliIconOption {
	id: string;
	label: string;
	component: any;
	description?: string;
}

/**
 * Registry resmi ikon visual poliklinik RSUD
 */
export const AVAILABLE_POLI_ICONS: PoliIconOption[] = [
	{ id: 'heart', label: 'Jantung (Heart)', component: Heart, description: 'Spesialis Jantung & Pembuluh Darah' },
	{ id: 'brain', label: 'Jiwa / Psikiatri (Brain)', component: Brain, description: 'Kesehatan Jiwa & Psikiatri' },
	{ id: 'shield', label: 'Kulit & Kelamin (Shield)', component: Shield, description: 'Spesialis Kulit & Kelamin' },
	{ id: 'eye', label: 'Mata (Eye)', component: Eye, description: 'Spesialis Mata & Refraksi' },
	{ id: 'bone', label: 'Orthopedi / Tulang (Bone)', component: Bone, description: 'Spesialis Orthopedi & Traumatologi' },
	{ id: 'wind', label: 'Paru / Respirasi (Wind)', component: Wind, description: 'Spesialis Paru & Pernapasan' },
	{ id: 'zap', label: 'Saraf / Neurologi (Zap)', component: Zap, description: 'Spesialis Saraf (Neurologi)' },
	{ id: 'ear', label: 'THT-KL / Telinga (Ear)', component: Ear, description: 'Spesialis Telinga, Hidung & Tenggorokan' },
	{ id: 'scissors', label: 'Bedah Onkologi (Scissors)', component: Scissors, description: 'Spesialis Bedah Onkologi / Kanker' },
	{ id: 'accessibility', label: 'Rehab Medik (Accessibility)', component: Accessibility, description: 'Kedokteran Fisik & Rehabilitasi' },
	{ id: 'baby', label: 'Anak / Pediatri (Baby)', component: Baby, description: 'Kesehatan Anak & Tumbuh Kembang' },
	{ id: 'bandage', label: 'Bedah Umum (Bandage)', component: Bandage, description: 'Spesialis Bedah Umum' },
	{ id: 'stethoscope', label: 'Penyakit Dalam (Stethoscope)', component: Stethoscope, description: 'Spesialis Penyakit Dalam (Interna)' },
	{ id: 'heart-pulse', label: 'Obstetri & Ginekologi (HeartPulse)', component: HeartPulse, description: 'Kebidanan & Kandungan (Obgyn)' },
	{ id: 'users', label: 'Keluarga Berencana / KB (Users)', component: Users, description: 'Pelayanan KB & Reproduksi' },
	{ id: 'zap-off', label: 'Nyeri / Pain Clinic (ZapOff)', component: ZapOff, description: 'Manajemen Intervensi Nyeri' },
	{ id: 'apple', label: 'Gizi Klinis (Apple)', component: Apple, description: 'Konsultasi Gizi & Dietetik' },
	{ id: 'sparkles', label: 'Gigi Endodonsi (Sparkles)', component: Sparkles, description: 'Konservasi Gigi & Saluran Akar' },
	{ id: 'smile-plus', label: 'Gigi Periodonti (SmilePlus)', component: SmilePlus, description: 'Jaringan Gusi & Penyangga Gigi' },
	{ id: 'smile', label: 'Gigi Prosthodonti (Smile)', component: Smile, description: 'Gigi Tiruan & Prostetik' },
	{ id: 'activity', label: 'Bedah Saraf (Activity)', component: Activity, description: 'Spesialis Bedah Saraf' },
	{ id: 'clipboard-check', label: 'Medical Check-Up / MCU (ClipboardCheck)', component: ClipboardCheck, description: 'Pemeriksaan Kesehatan Berkala' },
	{ id: 'scan', label: 'Radiologi / Rontgen (Scan)', component: Scan, description: 'Radiologi & Pencitraan Diagnostik' },
	{ id: 'microscope', label: 'Laboratorium (Microscope)', component: Microscope, description: 'Patologi Klinik & Darah Lengkap' }
];

/**
 * Mengambil komponen ikon Lucide berdasarkan nama string icon
 */
export function getPolyclinicIconComponent(iconName?: string): any {
	if (!iconName) return Stethoscope;
	const clean = iconName.toLowerCase().trim();
	const item = AVAILABLE_POLI_ICONS.find((i) => i.id === clean);
	if (item) return item.component;

	// Fallback alias matches
	switch (clean) {
		case 'heartpulse':
			return HeartPulse;
		case 'sparkle':
			return Sparkles;
		case 'smileplus':
			return SmilePlus;
		case 'zapoff':
			return ZapOff;
		case 'clipboardcheck':
			return ClipboardCheck;
		default:
			return Stethoscope;
	}
}
