'use client';

import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileTab } from "@/components/settings/ProfileTab";
import { SecurityTab } from "@/components/settings/SecurityTab";
import { PreferencesTab } from "@/components/settings/PreferencesTab";
import { DataTab } from "@/components/settings/DataTab";
import { FamilyTab } from "@/components/settings/FamilyTab";

export default function SettingsPage() {
  const t = useTranslations('Settings');

  return (
    <div className="space-y-6">
       <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('title')}</h1>
       
       <Tabs defaultValue="profile" className="space-y-4">
         <TabsList className="bg-muted text-muted-foreground border border-border w-full justify-start overflow-x-auto no-scrollbar">
           <TabsTrigger value="profile" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">{t('profile')}</TabsTrigger>
           <TabsTrigger value="security" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">{t('security')}</TabsTrigger>
           <TabsTrigger value="preferences" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">{t('preferences')}</TabsTrigger>
           <TabsTrigger value="family" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Family</TabsTrigger>
           <TabsTrigger value="data" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">{t('data')}</TabsTrigger>
         </TabsList>
         
         <TabsContent value="profile">
           <ProfileTab />
         </TabsContent>
         
         <TabsContent value="security">
           <SecurityTab />
         </TabsContent>
         
         <TabsContent value="preferences">
           <PreferencesTab />
         </TabsContent>

         <TabsContent value="family">
           <FamilyTab />
         </TabsContent>

         <TabsContent value="data">
           <DataTab />
         </TabsContent>
       </Tabs>
    </div>
  );
}
