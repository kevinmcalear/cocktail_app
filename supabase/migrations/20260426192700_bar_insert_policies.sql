-- Allow authenticated users to create a new bar
CREATE POLICY "Users can create bars" ON public.bars FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow admins to update their bars
CREATE POLICY "Admins can update bars" ON public.bars FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.user_bars 
        WHERE user_bars.bar_id = bars.id 
        AND user_bars.user_id = auth.uid() 
        AND user_bars.role_level >= 40
    )
);

-- Allow admins to delete their bars
CREATE POLICY "Admins can delete bars" ON public.bars FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.user_bars 
        WHERE user_bars.bar_id = bars.id 
        AND user_bars.user_id = auth.uid() 
        AND user_bars.role_level >= 40
    )
);

-- Allow users to insert themselves into user_bars (when creating a bar), or admins to insert others
CREATE POLICY "Users can insert their own bar roles or admins can add users" ON public.user_bars FOR INSERT WITH CHECK (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.user_bars ub 
        WHERE ub.bar_id = bar_id 
        AND ub.user_id = auth.uid() 
        AND ub.role_level >= 40
    )
);

-- Allow admins to update roles
CREATE POLICY "Admins can update bar roles" ON public.user_bars FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.user_bars ub 
        WHERE ub.bar_id = bar_id 
        AND ub.user_id = auth.uid() 
        AND ub.role_level >= 40
    )
);

-- Allow admins to remove users, or users to remove themselves
CREATE POLICY "Admins can delete bar roles or users can leave" ON public.user_bars FOR DELETE USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.user_bars ub 
        WHERE ub.bar_id = bar_id 
        AND ub.user_id = auth.uid() 
        AND ub.role_level >= 40
    )
);
